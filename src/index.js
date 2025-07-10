import { app } from "./app.js";
import connectDB from "./db/index.js";

// import dotenv from "dotenv";

// dotenv.config({
//     path: "./.env"
// })

//Server
const PORT = process.env.PORT;

connectDB()
.then(() => {
    app.listen(PORT,()=>{
    console.log(`Server is running at ${PORT}`)
    })
})
.catch((err) => {
    console.log("mongodb connection error")
})
