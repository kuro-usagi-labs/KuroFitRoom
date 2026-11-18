import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Project } from '@/types';
import { ExportScene, exportDimensions } from './ExportScene';

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'roomfit-plan'
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Render the plan into a detached SVG scene at a known scale, then serialise.
 * This keeps exported geometry identical to the editor without exporting UI.
 */
export function buildSvgString(project: Project): string {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(createElement(ExportScene, { project }));
    });
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('Could not render the plan for export.');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return `<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`;
  } finally {
    root.unmount();
    host.remove();
  }
}

export function saveProjectAsJson(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  download(blob, `${slug(project.name)}.roomfit.json`);
}

export function exportSvg(project: Project): void {
  const svg = buildSvgString(project);
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${slug(project.name)}.svg`);
}

export async function exportPng(project: Project): Promise<void> {
  const svg = buildSvgString(project);
  const { width, height } = exportDimensions(project);
  const pixelRatio = Math.min(3, Math.max(1, 2400 / width));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available in this browser.');
  const image = new Image();
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not render the PNG export.'));
      image.src = url;
    });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not create the PNG file.');
    download(blob, `${slug(project.name)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function readJsonFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('That file is larger than 8 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}
