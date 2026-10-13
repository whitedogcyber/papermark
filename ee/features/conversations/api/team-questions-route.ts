import type { NextApiRequest, NextApiResponse } from 'next';

export const teamQuestionsRoute = async (req: NextApiRequest, res: NextApiResponse) => {
  return res.status(501).json({ error: "Q&A feature is not enabled in the open source version." });
};

export default teamQuestionsRoute;
