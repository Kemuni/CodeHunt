export default function Home() {
  return (
    <div className="w-full overflow-hidden">
      <main className="flex flex-col my-12 mx-4 sm:mx-21 2xl:mx-42">
        <div className="w-full inline-flex">
          <div className="w-100 h-16 bg-gray-300"/>
          <div className="relative">
            <div className="absolute left-30 -bottom-1 size-20 rotate-45 bg-gray-300/25"/>
          </div>
        </div>
        <div className="w-full mt-14 flex justify-between">
          <div className="w-1/3 xl:w-2/5 h-10 bg-gray-300 rounded-full"/>
          <div className="w-fit flex gap-6 items-center">
            <span className="flex gap-2">
              <span className="w-30 h-5 bg-gray-300"/>
              <span className="w-15 h-5 bg-gray-600"/>
            </span>
            <div className="w-32 h-10 bg-gray-300 rounded-full"/>
          </div>
        </div>
        <div className="w-full mt-4 flex justify-between">
          <span className="w-100 h-5 bg-gray-300"/>
          <span className="w-20 h-5 bg-gray-300"/>
        </div>
        <div className="w-full mt-4 grid gap-x-4 gap-y-8 [&>div]:h-90 xl:[&>div]:h-104 grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <div className="bg-gray-300 rounded-2xl"/>
          <div className="bg-gray-300 rounded-2xl"/>
          <div className="bg-gray-300 rounded-2xl"/>
          <div className="bg-gray-300 rounded-2xl"/>
          <div className="bg-gray-300 rounded-2xl"/>
          <div className="bg-gray-300 rounded-2xl"/>
          <div className="bg-gray-300 rounded-2xl"/>
        </div>
      </main>
    </div>
  );
}
