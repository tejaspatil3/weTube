import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//middlewares
app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true
    })
)

app.use(cookieParser());

app.use(express.json({limit: "16kb"}))
// to securing and use the encoded data 
app.use(express.urlencoded({extended: true, limit: "16kb"}))

app.use(express.static("public"))

//import routes
import healthcheckRouter from "./routes/healthcheck.routes.js";
import userRouter from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import videoRouter from "./routes/video.routes.js"
//routes

app.use("/api/v1/healthcheckRouter", healthcheckRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/video", videoRouter)

app.use(errorHandler)
export { app }