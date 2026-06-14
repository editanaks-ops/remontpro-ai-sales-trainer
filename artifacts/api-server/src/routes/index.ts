import { Router, type IRouter } from "express";
import healthRouter from "./health";
import managersRouter from "./managers.js";
import trainingsRouter from "./trainings.js";
import adminRouter from "./admin.js";
import statsRouter from "./stats.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(managersRouter);
router.use(trainingsRouter);
router.use(adminRouter);
router.use(statsRouter);

export default router;
