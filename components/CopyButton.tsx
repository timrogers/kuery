import React, { useState } from 'react';

interface CopyButtonProps {
  textToCopy: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({
  textToCopy,
  children,
  style,
  className,
  title,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent event from bubbling up to parent elements
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 1500); // Reset after 1.5 seconds
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        // Optionally, provide error feedback
      });
  };

  return (
    <button
      onClick={handleCopyClick}
      style={style}
      className={className}
      title={title}
    >
      {copied ? '✔️' : children}
    </button>
  );
};

export default CopyButton;
