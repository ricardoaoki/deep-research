import cors from 'cors';
import express, { Request, Response } from 'express';

import {
  deepResearch,
  writeFinalAnswer,
  writeFinalReport,
} from './deep-research';
import {
  buildOsintPrompt,
  getOsintTemplates,
  validateOsintRequest,
} from './osint';

const app = express();
const port = process.env.PORT || 3051;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/api/osint/templates', (_req: Request, res: Response) => {
  res.json(getOsintTemplates());
});

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

// API endpoint to run research
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const { query, depth = 3, breadth = 3 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    log('\nStarting research...\n');

    const { learnings, visitedUrls } = await deepResearch({
      query,
      breadth,
      depth,
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );

    const answer = await writeFinalAnswer({
      prompt: query,
      learnings,
    });

    // Return the results
    return res.json({
      success: true,
      answer,
      learnings,
      visitedUrls,
    });
  } catch (error: unknown) {
    console.error('Error in research API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// API endpoint for scoped OSINT research briefs
app.post('/api/osint/research', async (req: Request, res: Response) => {
  try {
    const { errors, normalized } = validateOsintRequest(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const prompt = buildOsintPrompt(normalized);

    log('\nStarting OSINT research...\n');

    const { learnings, visitedUrls } = await deepResearch({
      query: prompt,
      breadth: normalized.breadth,
      depth: normalized.depth,
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );

    if (normalized.mode === 'answer') {
      const answer = await writeFinalAnswer({
        prompt,
        learnings,
      });

      return res.json({
        success: true,
        mode: normalized.mode,
        answer,
        learnings,
        visitedUrls,
      });
    }

    const report = await writeFinalReport({
      prompt,
      learnings,
      visitedUrls,
    });

    return res.json({
      success: true,
      mode: normalized.mode,
      report,
      learnings,
      visitedUrls,
    });
  } catch (error: unknown) {
    console.error('Error in OSINT research API:', error);
    return res.status(500).json({
      error: 'An error occurred during OSINT research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// generate report API
app.post('/api/generate-report', async (req: Request, res: Response) => {
  try {
    const { query, depth = 3, breadth = 3 } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    log('\n Starting research...\n');
    const { learnings, visitedUrls } = await deepResearch({
      query,
      breadth,
      depth,
    });
    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );
    const report = await writeFinalReport({
      prompt: query,
      learnings,
      visitedUrls,
    });

    return res.json({
      success: true,
      report,
      learnings,
      visitedUrls,
    });
  } catch (error: unknown) {
    console.error('Error in generate report API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Deep Research API running on port ${port}`);
});

export default app;
