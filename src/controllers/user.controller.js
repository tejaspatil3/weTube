import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"
// import { healthcheck } from "./routes/healthcheck.routes.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import { access } from "fs";
import { secureHeapUsed } from "crypto";
import { response } from "express";
import jwt from "jsonwebtoken";
import { json } from "stream/consumers";
import { Channel } from "diagnostics_channel";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        console.log(user)
        if(!user){
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
        avatar = await uploadOnCloudinary(avatarLocalPath, "profile")
        console.log("Uploaded avatar", avatar)

    }catch(error){
        console.log("Error uploading avatar",error)
        throw new ApiError(500, "Failed to upload avatar")
    }
    let coverImage;
    try{
        coverImage = await uploadOnCloudinary(coverImageLocalPath, "profile")
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
    //get data from body
    const { username , email , password } = req.body
    console.log(username)
    console.log(password)
    console.log(email)
    //validation
    if(!email){
        throw new ApiError(400, "Email is required")
    }
    const user = await User.findOne({
        $or: [{username},{email}]
        // serch by username or email
    })
    console.log(user)
    if(!user){
        throw new ApiError(404,"User not Found")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)
    console.log(isPasswordValid)
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

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const { oldPassword,newPassword } = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordValid){
        throw new ApiError(401,"Old Password is incorrect")
    }
    //auto encrypt by pre hook
    user.password = newPassword

    await user.save({validateBeforeSave: false})

    return res.status(200).json(new ApiResponse(200,{},"Password Changed Sucessfully"))
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res.status(200).json(new ApiResponse(200,req.user,"Current user Details"))
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const { fullname, email } = req.body

    if(!fullname) {
        throw new ApiError(400,"Fullname is required")
    }
    if(!email){
        throw new ApiError(400,"Email is Required")
    }
    const user = await User.findByIdAndUpdate(
        res.user?._id,
        {
            $set: {
                fullname,
                email,
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200, user, "Account Details Updated Successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath, "profile")
    if(!avatar.url) {
        throw new ApiError(500, "Something went wrong while uploading avatar image")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {   $set: {
                avatar : avatar.url
        }},{new: true}   
    )
    return res.status(200).json(new ApiResponse(200,user,"Avatar Updated Successfully"))

})

const updateUserCoverImage = asyncHandler(async(req,res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "File is required")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath, "profile")
    if(!coverImage.url) {
        throw new ApiError(500, "Something Went Wrong while Uploading")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {   $set: {
                coverImage : coverImage.url
        }},{new: true}   
    )

    return res.status(200).json(new ApiResponse(200,user,"CoverImage Updated Successfully"))
        
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const {username} = req.params
    if(!username?.trim()){
        throw new ApiError(400,"Username is Required")
    }
    // let channel
    const channel = await User.aggregate(
        [
            {
                $match: {
                    username: username?.toLowerCase()
                }
            },
            {
                $lookup: {
                    from: "Subscription",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "Subscription",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                $addFields: {
                    subscribersCount: {
                        $size:  { $split: ["$subscribers", ", "] }
                    },
                    channelsSubscribedTo: {
                        $size: { $split: ["subscribedTo", ", "] }
                    },//subscribe button
                    isSubscribed: {
                        $cond: {
                            if: {$in: [req.user?._id,"$subscribers.subscriber"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                //project data
                $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                    subscribersCount: 1,
                    channelsSubscribedTo: 1,
                    isSubscribed: 1,
                    coverImage: 1,
                    email: 1
                }
            }
        ]
    )
    // channel = [1,1,2]
    if(!channel?.length) {
        throw new ApiError(404,"Channel Not Found")
    }
    return res.status(200).json(new ApiResponse(200,channel[0],"Channel profile fetched successfully"
    ))
})

const getWatchHistory = asyncHandler(async(req,res) => {
    const user = await User.aggregate(
        [
            {
                $match: {
                    // _id: req.user?._id
                    _id: new mongoose.Schema.Types.ObjectId(req.user?._id)
                }
            },
            {
                $lookup: {
                    from: "Video",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchHistory",
                    pipeline: [
                        {
                            $lookup: {
                                from: "User",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        //project data
                                        $project: {
                                            fullname: 1,
                                            username: 1,
                                            avatar: 1,
                                            
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                owner: {
                                    // $arrayElementAt: ["owner",0]
                                    $first: "$owner"
                                }
                            }
                        }
                    ]
                }
            }
        ]
    )

    return res.status(200).json(new ApiResponse(200,user[0]?.watchHistory,"Watch history fetched sucessfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changeCurrentPassword,
    updateAccountDetails,
    updateUserCoverImage,
    updateUserAvatar,
    getUserChannelProfile,
    getWatchHistory,
    
}