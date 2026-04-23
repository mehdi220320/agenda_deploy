const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");

const uploadToCloudinary = (fileBuffer, originalFilename) => {
    const folder_name = process.env.CLOUDINARY_FOLDER_NAME || "AGENDA";

    const fileNameWithoutExt = originalFilename
        ? originalFilename.replace(/\.[^/.]+$/, "")
        : "file";

    const fileNameWithExt = originalFilename || "file";
    const isRaw = originalFilename?.match(/\.(pdf|docx?|xlsx?|txt|csv|zip|rar|pptx?)$/i);

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: folder_name,
                resource_type: isRaw ? "raw" : "auto",
                use_filename: true,
                unique_filename: false,
                filename_override: isRaw ? fileNameWithExt : fileNameWithoutExt,
                display_name: fileNameWithoutExt,
            },
            (error, result) => {
                if (result) {
                    // ✅ Just fix the /image/ -> /raw/ misclassification, nothing else
                    if (result.resource_type === "raw") {
                        result.secure_url = result.secure_url.replace(
                            "/image/upload/",
                            "/raw/upload/"
                        );
                    }
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );

        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

module.exports = uploadToCloudinary;