import jwt from "jsonwebtoken"
import {User} from "../models/user.models.js"
import { ApiError } from "../utils/apiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const verifyJWT = asyncHandler(async(req,_,next) => {
    // token stored in cookies for desktop
    try{
        const token = req.cookies.accessToken || req.header("Authorization")?.replace("bearer", "")
        
        if(!token){
            throw new ApiError(401, "Unauthorized Request")
        }    
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if(!user){
            throw new ApiError(401, "Unauthorized,Invalid Access Token")
        }
        // add more info
        req.user = user;
        next()
        // next controller
    }catch(error) {
        throw new ApiError(401, error?.message || "Invalid Access Token")
    }
})