import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async(localFilePath, subfolder) => {
    try{    

        if (!subfolder) {
            console.error("Subfolder is not specified.");
            fs.unlinkSync(localFilePath);
            return null;
        }

        if(!localFilePath) return null
        const response = await cloudinary.uploader.upload(
            localFilePath, {
                resource_type: "auto",
                folder: `wetube/user/${subfolder}`
            }
        )
        console.log("File Uploaded on Cloudinary. File src : " + response.url)
        fs.unlinkSync(localFilePath)
        return response
    }catch(err) {
        console.error("Error uploading file to Cloudinary:", err);
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return null;
    }
}

const deleteFromCloudinary = async (publicid) => {
    try{
       const result = await cloudinary.uploader.destroy(publicid)
       console.log("Deleted from cloudinary. Public_id : ",publicid)

    }catch(error){
        console.log("Error Deleting from Cloudinary",error)
        return null
    }
}

export { uploadOnCloudinary , deleteFromCloudinary }