import multer from 'multer';
import path from 'path';

// Set up multer storage for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/'); // Define the upload directory
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Save file with its original name
  },
});

// Filter to allow only CSV files
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === 'text/csv/xlsx' || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    cb(null, true);  // Accept CSV files
  } else {
    cb(new Error('Only CSV files are allowed!'), false); // Reject non-CSV files
  }
};

export const uploads = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 10 * 1024 * 1024 }  // Optional: Limit file size (e.g., 10MB)
});
