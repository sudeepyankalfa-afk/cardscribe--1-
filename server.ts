/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables
dotenv.config();

// Standard server configuration
const PORT = 3000;

async function startServer() {
  const app = express();

  // Accept larger body parameters for business card photo base64 uploads up to 20MB
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ limit: '30mb', extended: true }));

  // Initialize secure server-side Gemini Client
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } else {
    console.warn('WARNING: GEMINI_API_KEY env variable is not set. Cloud OCR engine will be unavailable.');
  }

  // API Route: Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', cloudOcrAvailable: !!ai });
  });

  // API Route: Cloud OCR with Structure Parsing using Gemini
  app.post('/api/ocr/cloud', async (req, res): Promise<any> => {
    if (!ai) {
      return res.status(503).json({
        error: 'Cloud OCR service is currently unconfigured (missing API key). Please use Local OCR.',
      });
    }

    try {
      const { image, images } = req.body;
      const imagesToProcess: string[] = [];
      if (Array.isArray(images)) {
        imagesToProcess.push(...images);
      } else if (image) {
        imagesToProcess.push(image);
      }

      if (imagesToProcess.length === 0) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const imageParts = [];
      for (const img of imagesToProcess) {
        // Convert standard Data URL to inlineData payload
        const match = img.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          return res.status(400).json({ error: 'Invalid image format. Expected a standard base64 image data URL.' });
        }

        const mimeType = match[1];
        const base64Data = match[2];

        imageParts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }

      const promptPart = {
        text: 'Perform high-accuracy OCR extraction and field parsing from the provided business card image(s) (there may be 1 or 2 images, representing the front and optionally back side of the card). Combine and synthesize details from both sides. Extract the Full Name, Professional Title, Company/Organization name, Phone numbers, Email addresses, Physical Addresses, and Websites. Assign confidence scores between 0 and 1 for each field based on how clear and legibly they are in the image(s). Also provide the raw text and split words coordinate mappings.',
      };

      // Define structured responseSchema
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          fullName: { type: Type.STRING, description: 'The extracted full name of the person.' },
          title: { type: Type.STRING, description: 'Professional title or job role (e.g. Lead Software Engineer).' },
          company: { type: Type.STRING, description: 'The company, firm, or brand name.' },
          phones: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'All identified phone numbers on the card in regional formats or E.164.',
          },
          emails: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'All identified RFC 5322-compliant email addresses.',
          },
          addresses: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Postal/office physical addresses.',
          },
          websites: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Any website URLs or social media profiles (e.g., LinkedIn).',
          },
          businessDomain: {
            type: Type.STRING,
            description: 'The industry or business domain of the contact/card (e.g. Technology, Healthcare, Finance, Education, Retail, Consulting, Real Estate, Food & Dining, Entertainment, Government, Legal, Manufacturing). Choose a concise, professional category.',
          },
          confidenceMap: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.NUMBER, description: 'Confidence score (0.0 to 1.0) for the fullName field.' },
              title: { type: Type.NUMBER, description: 'Confidence score (0.0 to 1.0) for the title field.' },
              company: { type: Type.NUMBER, description: 'Confidence score (0.0 to 1.0) for the company field.' },
              phones: { type: Type.NUMBER, description: 'Confidence score (0.0 to 1.0) for the phones list.' },
              emails: { type: Type.NUMBER, description: 'Confidence score (0.0 to 1.0) for the emails list.' },
              addresses: { type: Type.NUMBER, description: 'Confidence score (0.0 to 1.0) for the physical addresses.' },
              websites: { type: Type.NUMBER, description: 'Confidence score (0.0 to 1.0) for the websites.' },
              businessDomain: { type: Type.NUMBER, description: 'Confidence score (0.0 to 1.0) for the businessDomain field.' },
            },
            required: ['fullName', 'title', 'company', 'phones', 'emails', 'addresses', 'websites', 'businessDomain'],
          },
          rawText: { type: Type.STRING, description: 'Full raw text context parsed from the card for general reference.' },
          words: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                x0: { type: Type.NUMBER, description: 'Estimated horizontal start percentage coordinate (0-100).' },
                y0: { type: Type.NUMBER, description: 'Estimated vertical start percentage coordinate (0-100).' },
                x1: { type: Type.NUMBER, description: 'Estimated horizontal end percentage coordinate (0-100).' },
                y1: { type: Type.NUMBER, description: 'Estimated vertical end percentage coordinate (0-100).' },
              },
              required: ['text', 'x0', 'y0', 'x1', 'y1'],
            },
            description: 'Individual words with bounding-box metrics for box projection overlap.',
          },
        },
        required: [
          'fullName',
          'title',
          'company',
          'phones',
          'emails',
          'addresses',
          'websites',
          'businessDomain',
          'confidenceMap',
          'rawText',
          'words',
        ],
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: { parts: [...imageParts, promptPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Gemini model returned an empty response.');
      }

      const parsedJson = JSON.parse(responseText.trim());
      res.json(parsedJson);
    } catch (error: any) {
      console.error('Server Cloud OCR Error:', error);
      res.status(500).json({
        error: 'Secured Cloud API parsing error: ' + (error.message || 'Unknown server error'),
      });
    }
  });

  // Client SPA integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind to 0.0.0.0 and PORT 3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
