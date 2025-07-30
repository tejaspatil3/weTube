import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async(localFilePath) => {
    try{
        if(!localFilePath) return null
        const response = await cloudinary.uploader.upload(
            localFilePath, {
                resource_type: "auto"  //auto detect type of file
            }
        )
        console.log("File Uploaded on Cloudinary. File src:" + response.url)
        //remove from server after upload
        fs.unlinkSync(localFilePath)
        return response
    }catch(err) {
        fs.unlinkSync(localFilePath)
        return null
    }
}

export { uploadOnCloudinary }