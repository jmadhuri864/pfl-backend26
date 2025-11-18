
// import path from 'path';

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/'); // Specify the directory where files will be uploaded
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//      console.log(`Saving file: ${file.originalname} as ${Date.now()}${ext}`); // Log the filename being generated
//     cb(null, `${Date.now()}${ext}`); // Append a timestamp to the original file name
//   },
// });

// const upload = multer({
//   storage,
//   limits: {
//     fileSize: 2 * 1024 * 1024 // 2 MB limit for each file
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpg|jpeg|png|pdf/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);

//     if (extname && mimetype) {
//       return cb(null, true);
//     } else {
//       return cb(new Error('Only images and PDFs are allowed!'));
//     }
//   }
// });
// export{upload}
//  import { S3Client, GetObjectCommand ,PutObjectCommand} from '@aws-sdk/client-s3';
//  import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
 import multer from 'multer';



// // Configure S3Client
// const s3 = new S3Client({
//   region: process.env.AWS_DEFAULT_REGION || 'ap-south-1',
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAXYKJTAZ5GZCHEMHV',
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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',
//   },
// });


// async function getObjectURL(key: string) {
//   const command = new GetObjectCommand({
//     Bucket: process.env.AWS_S3_BUCKET || 'aws-sdk-node-upload',
//     Key: key,
//   });
//   const url = await getSignedUrl(s3, command); 
//   return url;
// }
// async function getObjectURL(key: string) {
//   // Constructing the public URL for the object (permanent URL)
//   const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${key}`;
//   return s3Url;
// }



// export async function putObject(file: Express.Multer.File): Promise<string> {
//   try {
//     const key = `uploads/${Date.now()}-${file.originalname}`;
//     const command = new PutObjectCommand({
//       Bucket: process.env.AWS_S3_BUCKET || 'aws-sdk-node-upload',
//       Key: key,
//       Body: file.buffer,
//       ContentType: file.mimetype,
//       //ACL: 'public-read', // This makes the object publicly accessible
//     });
//     const url = new GetObjectCommand({
//           Bucket: process.env.AWS_S3_BUCKET || 'aws-sdk-node-upload',
//           Key: key,
//         });
//         const url1= await getSignedUrl(s3, command); 
//         return url1;
//     await s3.send(command);

//     //return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${key}`;
//   } catch (error) {
//     console.error("Error uploading to S3:", error);
//     throw new Error("Failed to upload file to S3");
//   }
// }

// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 6 * 1024 * 1024, // 5 MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpg|jpeg|png|xlsx|xls|csv/;
//     const extname = allowedTypes.test(file.originalname.toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);

//     if (extname && mimetype) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only images and PDFs are allowed!'));
//     }
//   },
// });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB
  fileFilter: (req, file, cb) => {
    const allowedExt = /jpg|jpeg|png|pdf|xlsx|xls|csv/;
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];

    const extname = allowedExt.test(file.originalname.toLowerCase());
    const mimetype = allowedMimeTypes.includes(file.mimetype);

    console.log("File type check:", { extname, mimetype, originalname: file.originalname, mimetypeRaw: file.mimetype });

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only images, PDFs, and Excel/CSV files are allowed!"));
    }
  },
});


// Handlers for non-file and generic uploads
const uploadNone = multer().none(); // For handling non-file form data
const uploadAny = multer().any(); // For handling files of any type or field

export {  upload, uploadNone, uploadAny }; // Export the upload handler
