import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try{
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)

        console.log(`mongodb connection success\nMONGO_DB HOst ${connectionInstance.connection.host}`)

    }catch(err){
        console.log("mongodb conection error",err)
        process.exit(1)
    }
}

export default connectDB