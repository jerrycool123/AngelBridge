import { NextApiRequest, NextApiResponse } from 'next';

const Handler = (_req: NextApiRequest, res: NextApiResponse) => res.status(204).end();

export default Handler;
