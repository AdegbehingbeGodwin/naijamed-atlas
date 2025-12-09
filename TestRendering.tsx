// Test file to demonstrate the improved text and image rendering components
import React from 'react';
import { createRoot } from 'react-dom/client';
import RichTextRenderer from './components/RichTextRenderer';
import ImageViewer from './components/ImageViewer';

const TestComponent: React.FC = () => {
  const sampleText = `This is **bold text** and this is *italic text*. Here's a [link](https://example.com) for demonstration.

1. First item
2. Second item
3. Third item

- Bullet point 1
- Bullet point 2
- Bullet point 3

This is a paragraph with more text to see how it renders with the new RichTextRenderer component.`;

  return (
    <div className="p-8 max-w-3xl mx-auto bg-white">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">NaijaMed Atlas - Rendering Test</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-slate-700">Rich Text Rendering Example</h2>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <RichTextRenderer text={sampleText} />
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-4 text-slate-700">Image Viewer Example</h2>
        <ImageViewer 
          src="/logo.png" 
          alt="NaijaMed Atlas Logo" 
          caption="Logo of the NaijaMed Atlas application"
        />
      </div>
    </div>
  );
};

// Mount the test component
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<TestComponent />);
}

export default TestComponent;