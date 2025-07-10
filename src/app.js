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

//routes

app.use("/api/v1/healthcheckRouter", healthcheckRouter)


export { app }