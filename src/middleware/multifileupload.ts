// import multer from 'multer';
// import path from 'path';

// // Configure storage for uploaded files
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     console.log("in storage",file);
//     cb(null, 'multiuploads/'); // Specify the directory for uploads
//   },
//   filename: (req, file, cb) => {
//     console.log("in filename",file);
//     const ext = path.extname(file.originalname);
//     console.log(`Saving file: ${file.originalname} as ${Date.now()}${ext}`);
//     cb(null, `${Date.now()}${ext}`); // Use timestamp to avoid filename conflicts
//   },
// });

// // Create a Multer instance to allow different types of files
// const upload = multer({
//   storage,
//   limits: {
//     fileSize: 10* 1024 * 1024, // Limit file size to 10 MB
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpg|jpeg|png|pdf/; // Allow images and PDFs
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);

//     if (extname && mimetype) {
//       return cb(null, true); // Accept file
//     } else {
//       return cb(new Error('Only JPG, JPEG, PNG images, and PDFs are allowed!')); // Reject file
//     }
//   },
// });

// export { upload };
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY!,   
    secretAccessKey: process.env.ACCESS_SECRET!,  
  },
  region: process.env.REGION,   
});


const BUCKET_NAME = process.env.BUCKET_NAME as string;  

// Multer-S3 storage configuration
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: BUCKET_NAME,
    //acl: 'public-read', // Access control for files
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `singleuploads/${Date.now()}_${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpg|jpeg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true); // Accept file
    } else {
      cb(new Error('Only JPG, JPEG, PNG images, and PDFs are allowed!')); // Reject file
    }
  },
});

export { upload };
