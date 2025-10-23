"use client";

export default function DonatePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8 text-center">
      {/* Title */}
      <h1 className="text-4xl font-bold mb-6">Support Sweetcontrol</h1>

      {/* Short description */}
      <p className="max-w-xl text-gray-300 mb-10 leading-relaxed">
        Sweetcontrol is a smart control and monitoring project built to help
        simulate and understand diabetic patient behavior through interactive
        machine control and real-time data visualization.  
        <br />
        <br />
        Your contribution helps us continue improving and bringing this
        educational project to more people.
      </p>

      {/* Placeholder donate button */}
      <button
        className="bg-pink-600 hover:bg-pink-500 transition-all px-8 py-3 rounded-xl text-lg font-semibold shadow-lg"
        onClick={() => alert("Donation feature coming soon ❤️")}
      >
        ❤️ Support Project
      </button>

      {/* Small footer note */}
      <p className="text-gray-500 text-sm mt-10">
        © {new Date().getFullYear()} Sweetcontrol — Built with love and purpose.
      </p>
    </div>
  );
}
