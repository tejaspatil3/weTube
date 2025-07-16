import { asyncHandler } from "../utils/asyncHandler.js";
import healthcheck from "./routes/healthcheck.routes.js";
import { ApiError } from "../utils/apiError.js";
import {User} from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"

const registerUser = asyncHandler( async (req, res) =>{
    //
    const {fullname, email, username, password} = req.body

    ///validation
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

    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    let coverImage = ""
    if(coverImageLocalPath) {
        // throw new ApiError(400, "cover Image file is missing")
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    }

    const user = await User.create({
        fullname,
        avatar : avatar.url,
        coverImage : coverImage.url  ||  "",
        email,
        password,
        username : username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
        //verifying user created
    )  
    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering user")
    }

    return res
        .status(201)
        .json(new ApiResponse(200, createdUser, "User registered sucessfully"))
   
})

export {
    registerUser
}