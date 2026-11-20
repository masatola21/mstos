import React from 'react';
import { splitTextWithUrls } from '../../utils/linkify';

export interface LinkifiedTextProps {
  text: string;
  linkClassName?: string;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  linkClassName = 'underline text-indigo-600 hover:text-indigo-800 break-all transition-colors',
}) => {
  if (!text) return null;
  const segments = splitTextWithUrls(text);

  return (
    <>
      {segments.map((seg, idx) =>
        seg.type === 'url' ? (
          <a
            key={`${idx}-${seg.href}`}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={linkClassName}
          >
            {seg.value}
          </a>
        ) : (
          <React.Fragment key={idx}>{seg.value}</React.Fragment>
        )
      )}
    </>
  );
};
