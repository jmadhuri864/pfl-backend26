
import { S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path'
import AppError from '../utils/appError';


//console.log(process.env.ACCESS_KEY, process.env.ACCESS_SECRET, process.env.REGION, process.env.BUCKET_NAME);


const s3 = new S3Client({
    credentials: {
      accessKeyId: process.env.ACCESS_KEY!,   
      secretAccessKey: process.env.ACCESS_SECRET!,  
    },
    region: process.env.REGION,   
  });
  //console.log(s3)
 
  const BUCKET_NAME = process.env.BUCKET_NAME as string;  
  
  
  const storage = multerS3({
    s3: s3,
    bucket: BUCKET_NAME,
    metadata: (req, file, cb) => {
      console.log('in metadata', file);
      cb(null, { fieldName: file.fieldname });
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,  
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);  
      console.log(`Saving file: ${file.originalname} as ${Date.now()}${ext}`);
      cb(null, `uploadsMulti/${file.originalname}${ext}`); 
    },
  });
  
  
  const uploadFileMultiple = multer({
    storage,
    limits: {
      fileSize: 1 * 1024 * 1024, 
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx/;  
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
  
      if (extname && mimetype) {
        return cb(null, true);  
      }    else {
        return cb(new AppError(400 , 'Only JPG, JPEG, PNG images, and PDFs are allowed!')); 
      }
      
      
    },
  });

 
  
  export {uploadFileMultiple};