'use client';

import { Button } from '@/components/ui/button';

export default function Web() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-gray-100">
      <h1 className="mb-4 text-3xl font-bold text-blue-600">
        Web App with Tailwind
      </h1>
      <Button onClick={() => console.log('Pressed!')}>Boop</Button>
    </div>
  );
}
