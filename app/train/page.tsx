"use client";

import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import Link from 'next/link';

export default function ImageSlicer() {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  // Xử lý khi chọn file và tạo ảnh preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setImages(selectedFiles);

      // Tạo các URL preview
      const previewUrls = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviews(previewUrls);
    }
  };

  // Dọn dẹp bộ nhớ khi component bị unmount hoặc chọn ảnh mới
  useEffect(() => {
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const processImages = async () => {
    if (images.length === 0) return;
    setProcessing(true);
    const zip = new JSZip();

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      canvas.width = height; 
      canvas.height = height;

      let startX = 0;
      let count = 0;

      while (startX + height <= width) {
        ctx.clearRect(0, 0, height, height);
        ctx.drawImage(bitmap, startX, 0, height, height, 0, 0, height, height);
        
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        if (blob) {
          zip.file(`${file.name.split('.')[0]}_part_${count}.jpg`, blob);
        }
        startX += 20; //bước nhảy
        count++;
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "processed_images.zip";
    link.click();
    
    setProcessing(false);
  };

  return (
    <div className="p-10 flex flex-col items-center gap-6 font-sans relative min-h-screen bg-gray-50">
      {/* Nút trở về */}
      <div className="absolute top-5 left-5">
        <Link prefetch={false} href="/" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium bg-white px-4 py-2 rounded-full shadow-sm">
          ← Trở về trang chủ
        </Link>
      </div>
      {/* Khu vực Upload */}
      <div className="border-2 border-dashed border-blue-300 p-8 rounded-2xl bg-white w-full max-w-2xl text-center shadow-inner">
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
        />
        <p className="mt-3 text-gray-400 text-sm">Hỗ trợ JPG, PNG, WebP...</p>
      </div>

      {/* Hiển thị Preview */}
      {previews.length > 0 && (
        <div className="w-full max-w-4xl">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Ảnh đã chọn ({previews.length}):</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {previews.map((url, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white">
                <img 
                  src={url} 
                  alt={`preview ${index}`} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">Ảnh {index + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nút Xử lý */}
      <button
        onClick={processImages}
        disabled={processing || images.length === 0}
        className={`mt-6 px-10 py-4 rounded-full text-white font-bold text-lg shadow-xl transition-all transform ${
          processing ? 'bg-gray-400 scale-95' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95'
        }`}
      >
        {processing ? (
          <span className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Đang cắt ảnh...
          </span>
        ) : 'Bắt đầu xử lý & Tải về (.zip)'}
      </button>
    </div>
  );
}