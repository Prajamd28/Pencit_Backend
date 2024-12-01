const multer = require ("multer");
const path = require("path");

//Story
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads"); //destination folder
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname)); //unique filename
        },
});

//file filter ony image
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")){
        cb(null, true);
    } else {
        cb(new Error("Only Image Bung"), false);
    }
};

//initiate multer
const upload = multer({storage, fileFilter});

module.exports = upload;