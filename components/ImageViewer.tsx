import React, { useState, useEffect } from 'react';

interface ImageViewerProps {
  src: string;
  alt?: string;
  caption?: string;
  className?: string;
  width?: string | number;
  height?: string | number;
  showCaption?: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ 
  src, 
  alt = 'Image', 
  caption, 
  className = '', 
  width = '100%', 
  height = 'auto',
  showCaption = true
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Reset states when src changes
    setImageLoaded(false);
    setImageError(false);
  }, [src]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  if (imageError) {
    return (
      <div className={`flex flex-col items-center justify-center border border-slate-200 rounded-lg bg-slate-50 p-4 ${className}`}>
        <div className="text-slate-400 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">Image could not be loaded</p>
        {caption && showCaption && (
          <p className="text-xs text-slate-400 mt-2 italic">{caption}</p>
        )}
      </div>
    );
  }

  return (
    <figure className={`inline-block ${className}`}>
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-0">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`w-full h-auto object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            display: imageLoaded ? 'block' : 'none'
          }}
        />
      </div>
      {caption && showCaption && (
        <figcaption className="mt-2 text-sm text-slate-500 italic text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export default ImageViewer;