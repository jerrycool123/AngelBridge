import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

const Handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const token = await getToken({ req });
  console.log(token);

  return res.json({ token });
};

export default Handler;
