import React, { forwardRef, useEffect, useRef } from 'react';
import { useResolvedMediaUrl } from '../services/mediaCache';

type ResolvedImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

export const ResolvedImg = forwardRef<HTMLImageElement, ResolvedImgProps>(
  ({ src, onError, className, alt = '', ...rest }, ref) => {
    const { resolvedSrc, isResolving, isMissing } = useResolvedMediaUrl(src);
    const missingNotifiedRef = useRef<string | null>(null);

    useEffect(() => {
      if (!isMissing) {
        missingNotifiedRef.current = null;
        return;
      }
      if (src && missingNotifiedRef.current !== src) {
        missingNotifiedRef.current = src;
        if (onError) {
          onError({} as React.SyntheticEvent<HTMLImageElement, Event>);
        }
      }
    }, [isMissing, src, onError]);

    if (isResolving || isMissing || !resolvedSrc) {
      return (
        <div
          aria-hidden="true"
          className={`${className || ''} ${isResolving ? 'animate-pulse bg-neutral-700/20' : ''}`.trim()}
        />
      );
    }

    return (
      <img
        ref={ref}
        src={resolvedSrc}
        alt={alt}
        className={className}
        onError={onError}
        {...rest}
      />
    );
  }
);

ResolvedImg.displayName = 'ResolvedImg';
