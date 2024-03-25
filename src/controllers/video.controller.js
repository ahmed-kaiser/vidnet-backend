import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    searchQuery,
    sortBy,
    sortType,
    userId,
  } = req.query;

  if (isNaN(parseInt(page)) || isNaN(parseInt(limit))) {
    throw new ApiError(400, "Invalid page or limit value");
  }

  page = Math.max(1, parseInt(page));
  limit = Math.max(1, parseInt(limit));

  // Calculate skip efficiently using Math.max to handle negative values
  const skip = Math.max(0, (page - 1) * limit);

  const queryCondition = {};

  if (userId) {
    queryCondition.owner = userId;
  }

  if (searchQuery) {
    queryCondition.title = { $regex: searchQuery, $options: "i" };
  }

  const sort = {};

  if (sortBy && sortType) {
    sort[sortBy] = sortType === "asc" ? 1 : -1;
  }

  const videos = await Video.find(queryCondition)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .exec();

  if (!videos) {
    throw new ApiError(500, "Failed to get videos");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { videos }, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title.trim() && !description.trim()) {
    throw new ApiError(400, "All data information is required");
  }

  const videoFileLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLOcalPath = req.files?.thumbnail[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video file is required");
  }

  if (!thumbnailLOcalPath) {
    throw new ApiError(400, "Thumbnail file is required");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLOcalPath);

  if (!videoFile) {
    throw new ApiError(500, "Failed to upload video please try again");
  }

  if (!thumbnail) {
    throw new ApiError(
      500,
      "Failed to upload thumbnail image please try again"
    );
  }

  const video = await Video.create({
    title,
    description,
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    duration: videoFile.duration,
    owner: req.user._id,
  });

  if (!video) {
    throw new ApiError(500, "Failed to publish video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (title.trim() === "" || description.trim() === "") {
    throw new ApiError(400, "All fields are required");
  }

  const thumbnailLocalPath = req.file?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail image is required");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail) {
    throw new ApiError(500, "Failed to upload thumbnail image");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: { title, description, thumbnail: thumbnail.url },
    },
    { new: true }
  );

  if (!updatedVideo) {
    throw new ApiError(500, "Failed to update");
  }

  res
    .status(200)
    .json(200, { video: updateVideo }, "Video file updated successfully");
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "Video not found");
  }

  if (video.owner !== req.user._id) {
    throw new ApiError(401, "Unauthorize request");
  }

  await video.deleteOne();

  const deleteVideo = await Video.findById(videoId);

  if (deleteVideo) {
    throw new ApiError(500, "Failed to delete video");
  }

  return res.status(200).json(200, {}, "Video deleted successfully");
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "Video not found");
  }

  video.isPublished = !video.isPublished;
  const updateVideo = await video.save();

  return res
    .status(200)
    .json(
      200,
      { video: updateVideo },
      "Update video published state successfully"
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
