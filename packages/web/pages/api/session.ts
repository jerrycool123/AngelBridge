import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';

import { authOptions } from './auth/[...nextauth]';

const Handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);

  return res.json({ session });
};

export default Handler;
