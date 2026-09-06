import { Router } from 'express';

import { requireAuthentication } from '../../middleware/auth.js';
import { login, me, register } from './controller.js';

const authRouter: Router = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', requireAuthentication, me);

export { authRouter };
