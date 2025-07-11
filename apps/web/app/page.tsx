"use client";

export default function Web() {
  return (
    <div className="flex-1 items-center justify-center bg-gray-100 min-h-screen flex flex-col">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">
        Web App with Tailwind
      </h1>
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded-md active:bg-blue-600 cursor-pointer"
        onClick={() => console.log("Pressed!")}
      >
        Boop
      </button>
    </div>
  );
}
