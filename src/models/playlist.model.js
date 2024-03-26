import mongoose from "mongoose";

const playlistSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: [true, "Title is required"],
    },
    description: {
      type: String,
    },
    videos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    visibility: {
      type: String,
      enum: {
        values: ["Public", "Private"],
        message: "value is not supported, must be Public or Private",
      },
      default: "Private",
      required: [true, "Visibility property is required"],
    },
  },
  { timestamps: true }
);

export const Playlist = mongoose.model("Playlist", playlistSchema);
