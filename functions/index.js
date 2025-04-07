import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import axios from "axios";

initializeApp();

export const processImage = onRequest(async (req, res) => {
  try {
    const { imagePath } = req.body;
    if (!imagePath) {
      return res.status(400).json({ error: "Image path is required." });
    }

    // 🔥 Use Firebase Storage emulator bucket to get the image buffer
    const bucket = getStorage().bucket();
    const file = bucket.file(imagePath);
    const [imageBuffer] = await file.download();
    const base64Image = imageBuffer.toString("base64");
    console.log("Image downloaded ");
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=AIzaSyDIj71w-Pp6WKR3Un1oOVOCTHan9rKuzxQ`,
      {
        contents: [
          {
            parts: [
              { text: "Transform this image into a Ghibli-style illustration." },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image,
                },
              },
            ],
          },
        ],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("Response received from gemini",geminiResponse);
   
    console.log(JSON.stringify(geminiResponse.data, null, 2));
    const candidate = geminiResponse.data?.candidates?.[0];
    const parts = candidate?.content?.parts?.[0];
    
    if (!parts?.inlineData?.data) {
      throw new Error("Failed to parse Gemini response. No image data found in inlineData.");
    }
    
    const base64ImageTranformed = parts.inlineData.data;
    
    
    // const base64ImageTranformed = geminiResponse.data.candidates[0].content.parts[0].inlineData.data;
   console.log("Tranforming iamge");
    
    console.log("Response received from Image",base64ImageTranformed);
    const imageBufferTranformed = Buffer.from(base64ImageTranformed, 'base64');

    
    // const transformedImageBase64 = geminiResponse.data.contents[0].parts[0].inline_data.data;

    if (!imageBufferTranformed) {
        throw new Error("Failed to parse Gemini response. No image data found.");
      }

    const transformedImageBuffer = Buffer.from(imageBufferTranformed, "base64");
    console.log("Tranformed Image");
    const newFileName = `ghibli_images/${Date.now()}.jpg`;
    const newFile = bucket.file(newFileName);
    await newFile.save(transformedImageBuffer, { contentType: "image/jpeg" });

    const [signedUrl] = await newFile.getSignedUrl({
      action: "read",
      expires: "03-01-2030",
    });

    res.json({ transformedImageUrl: signedUrl });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});
