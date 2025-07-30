import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import {User} from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"
// import { healthcheck } from "./routes/healthcheck.routes.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import { throwDeprecation } from "process";
import { access } from "fs";
import { secureHeapUsed } from "crypto";
import { response } from "express";
import jwt from "jsonwebtoken";
import { json } from "stream/consumers";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        if(!User){
            throw new ApiError(404,"User not Found")
        }
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
    
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        return({accessToken,refreshToken})
    } catch (error) {
        throw new ApiError(500, "Something Went Wrong while generating Access and Refresh Token")
    }
}

const registerUser = asyncHandler( async (req, res) =>{
    //
    const {fullname, email, username, password} = req.body;

    if(
        [fullname, email, username, password].some((field) => field?.trim() === "")
    )
    {
        throw new ApiError(400, "All Fields are required")
    }

    // if(fullname?.trim() === "") // optional chaining -- ?. (Optional Chaining): This is a relatively new JavaScript feature. It allows you to safely access properties of an object that might be null or undefined without causing an error.
    // man? optionally go ahead
    // {
    //     throw new ApiError(400, "fullname is required")
    // }
    
    const existedUser = await User.findOne({
        $or: [{username},{email}]
        // serch by username or email
    })

    if(existedUser){
        throw new ApiError(409, "User email or username already exist")
    }
    console.warn(req.files)
    //destructuring
    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    // const avatar = await uploadOnCloudinary(avatarLocalPath)
    // let coverImage = ""
    // if(coverImageLocalPath) {
    //     // throw new ApiError(400, "cover Image file is missing")
    //     const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    // }

    let avatar;
    try{
        avatar = await uploadOnCloudinary(avatarLocalPath)
        console.log("Uploaded avatar", avatar)

    }catch(error){
        console.log("Error uploading avatar",error)
        throw new ApiError(500, "Failed to upload avatar")
    }
    let coverImage;
    try{
        coverImage = await uploadOnCloudinary(coverImageLocalPath)
        console.log("Uploaded coverImage", coverImage)

    }catch(error){
        console.log("Error uploading coverImage",error)
        throw new ApiError(500, "Failed to uplaod coverImage")
    }

    try {
        const user = await User.create({
            fullname,
            avatar : avatar.url || "",
            coverImage : coverImage.url  ||  "",
            email,
            password,
            username : username.toLowerCase()
        })
    
        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
            // verifying user created
            // password and refreshToken not saved to db
        )  
        if(!createdUser) {
            throw new ApiError(500, "Something went wrong while registering user")
        }
        return res
            .status(201)
            .json(new ApiResponse(200, createdUser, "User registered sucessfully"))
   
    } catch (error) {
        console.log("User Creation Failed")
        if(avatar) {
            await deleteFromCloudinary(avatar.public_id)
        }
        if(coverImage) {
            await deleteFromCloudinary(coverImage.public_id)
        }
        throw new ApiError(500, "Something went wrong while registering user and images were deleted")
        
    }
})

const loginUser = asyncHandler(async(req,res) => {
    //get data form body
    const{username,email,password} = req.body
    //validation
    if(!email){
        throw new ApiError(400, "Email is required")
    }
    const user = await User.findOne({
        $or: [{username},{email}]
        // serch by username or email
    })
    if(!user){
        throw new ApiError(404,"User not Found")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) {
        throw new ApiError(401,"Invalid User Credentials")
    }
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken")
    if(!loggedInUser){
        throw new ApiError(404,"Something went Wrong")
    }
    const options = {
        httpOnly : true,
        secure:process.env.NODE_ENV == "production",
    }
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json( new ApiResponse(200,
            {user:loggedInUser,accessToken,refreshToken},
            "User Logged in Successfully"
        ))
})

const logoutUser = asyncHandler(async(req,res) => {
    const user =  await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: null,
            }
        },
        {new:true}
    )

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV == "production",
    }

    return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refrehToken",options)
        .json(new ApiResponse(200,{},"User logged out Successfully"))
})

const refreshAccessToken = asyncHandler( async(req,res) => {
    // token stored in cookies for desktop
    // not for mobile
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) {
        throw new ApiError(401, "Refresh Token is Required")
    }
    //find user 
    try{
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,

        )
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(404,"Invalid Refresh Token")
        }
        if(user?.refreshToken !== incomingRefreshToken) {
            throw new ApiError(404,"Invalid Refresh Token")
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV == "production",
        }
        const {accessToken, refreshToken : newRefreshToken} = await generateAccessAndRefreshToken(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken,options)
            .cookie("refreshToken", newRefreshToken,options)
            .json(new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Access token refreshed Successfully"

            
        ));

    }catch(error){
        throw new ApiError(500, "Something Went Worng while refreshing acccess token")
    }
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}