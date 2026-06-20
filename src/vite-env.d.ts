/// <reference types="vite/client" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Or for plain CSS imports:
declare module '*.css' {
  const content: string;
  export default content;
}