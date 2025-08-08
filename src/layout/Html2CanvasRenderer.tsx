import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import styles from '../App.module.css';

interface Html2CanvasRendererProps {
  sourceElement: HTMLElement | null;
  width?: number;
  height?: number;
  showOutlines?: boolean;
  refreshTrigger?: any;
}

export const Html2CanvasRenderer: React.FC<Html2CanvasRendererProps> = ({
  sourceElement,
  width,
  height,
  showOutlines = false,
  refreshTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!sourceElement || !containerRef.current) {
      return;
    }

    const renderToCanvas = async () => {
      try {
        // Get the parent wrapper element which has the correct dimensions
        const wrapperElement = sourceElement.parentElement;
        if (!wrapperElement) return;
        
        // Create a temporary container with proper dimensions
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.width = `${wrapperElement.offsetWidth}px`;
        tempContainer.style.height = `${wrapperElement.offsetHeight}px`;
        tempContainer.style.overflow = 'hidden';
        document.body.appendChild(tempContainer);
        
        // Clone the source element
        const clonedElement = sourceElement.cloneNode(true) as HTMLElement;
        clonedElement.style.position = 'relative';
        clonedElement.style.width = '100%';
        clonedElement.style.height = '100%';
        clonedElement.style.color = 'black';
        clonedElement.style.opacity = '1';
        
        // Ensure all text elements have black color
        const allTextElements = clonedElement.querySelectorAll('*');
        allTextElements.forEach((el) => {
          const element = el as HTMLElement;
          element.style.color = 'black';
          // Preserve the original layout
          if (element.style.position === 'absolute') {
            element.style.position = 'relative';
          }
        });
        
        tempContainer.appendChild(clonedElement);
        
        // Render with html2canvas
        const renderedCanvas = await html2canvas(clonedElement, {
          backgroundColor: '#ffffff',
          scale: window.devicePixelRatio,
          width: wrapperElement.offsetWidth,
          height: wrapperElement.offsetHeight,
          logging: false,
          useCORS: true,
          allowTaint: true,
        });
        
        // Clean up
        document.body.removeChild(tempContainer);

        setCanvas(renderedCanvas);
      } catch (error) {
        console.error('Error rendering with html2canvas:', error);
      }
    };

    // Add a small delay to ensure DOM is ready
    const timeoutId = setTimeout(renderToCanvas, 100);
    return () => clearTimeout(timeoutId);
  }, [sourceElement, width, height, showOutlines, refreshTrigger]);

  useEffect(() => {
    if (canvas && containerRef.current) {
      // Clear previous canvas if any
      containerRef.current.innerHTML = '';
      
      // Apply styles to the canvas
      canvas.className = styles.canvas;
      if (width && height) {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      
      // Add the canvas to the container
      containerRef.current.appendChild(canvas);
    }
  }, [canvas, width, height]);

  return <div ref={containerRef} />;
};