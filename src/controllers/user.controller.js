import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import mongoose from "mongoose";

const options = {
  httpOnly: true,
  secure: true,
};

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Server error");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // step 1 - get details from frontend user
  // step 2 - validation
  // step 3 - check if user already exist : by username and email
  // step 4 - check for images, check for abatar
  // step 5 - upload image to cloudinary, avatar
  // step 6 - create user object and create entry in bd
  // step 7 - remove password and refresh token field from response
  // step 8 - check for user creation
  // step 9 - return response

  const { username, email, fullName, password } = req.body;

  if (
    [username, email, fullName, password].some((field) => field.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // validate email format
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, "Provide email in right format");
  }

  // check user already exist
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser?.username === username) {
    throw new ApiError(400, "User with username already exist");
  }

  if (existedUser?.email === email) {
    throw new ApiError(400, "User with email already exist");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is require");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Failed to upload avatar image please try again");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Failed to register something went wrong");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User regisetered successfull"));
});

const loginUser = asyncHandler(async (req, res) => {
  // get data from req.body
  // username or email
  // find the user
  // check password
  // generate access and refresh token
  // send cookies

  const { email, username, password } = req.body;

  if (!email && !username) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(400, "User does not exist");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedinUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedinUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  try {
    const id = req?.user?._id;

    await User.findByIdAndUpdate(
      id,
      {
        $set: {
          refreshToken: "",
        },
      },
      { new: true }
    );

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged out"));
  } catch (error) {
    throw new ApiError(500, "Server error");
  }
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorize request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refresh successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  try {
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;

  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { email, fullName } = req.body;

  if (!email || !fullName) {
    throw new ApiError(400, "All fields are required");
  }

  let updatedUser;
  try {
    updatedUser = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: { fullName, email },
      },
      { new: true }
    ).select("-password -refreshToken");
  } catch (error) {
    if (error.codeName === "DuplicateKey" && "email" in error.keyPattern) {
      throw new ApiError(400, "Email already exist");
    } else {
      throw new ApiError(500, "Server error");
    }
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: updatedUser },
        "Account details updated successfully"
      )
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is require");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(500, "Error while uploading avatar");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar: avatar.url } },
    { new: true }
  ).select("-password -refreshToken");

  if (!updatedUser) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { user: updatedUser }, "Avatar updated successfully")
    );
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is require");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(500, "Error while uploading cover image");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { coverImage: coverImage.url } },
    { new: true }
  ).select("-password -refreshToken");

  if (!updatedUser) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: updatedUser },
        "Cover image updated successfully"
      )
    );
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is require");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribeTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribeTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscriberCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(400, "No data available");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { data: channel[0] },
        "User channel fetched successfully"
      )
    );
});

const getUserWatchHistory = asyncHandler(async (req, res) => {
  const id = req.user?._id;

  let user;
  try {
    user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Schema.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "videos",
          foreignField: "_id",
          localField: "watchHistory",
          as: "watchHistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                foreignField: "_id",
                localField: "owner",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullName: 1,
                      username: 1,
                      avatar: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                owner: {
                  $first: "$owner",
                },
              },
            },
          ],
        },
      },
    ]);
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { data: user[0]?.watchHistory },
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getUserWatchHistory,
};
