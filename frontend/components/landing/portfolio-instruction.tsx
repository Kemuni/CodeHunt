import Image from "next/image"
import {DoubleSlash} from "@/components/icons";

export function PortfolioInstruction() {
  return (
    <section
      className="flex flex-col gap-6 2xl:gap-8 overflow-hidden  w-full"
      aria-labelledby="how-to-start-title"
    >
      {/* <div className="mx-auto flex w-[min(84%,1209px)] flex-col items-center">
        <p className="m-0 inline-flex items-center gap-2 text-base leading-[18px]
                      text-primary/50
                      2xl:text-lg 2xl:leading-[19px]">
          <DoubleSlash className="size-4" aria-hidden="true" />
          Что делать если
        </p>
        <h2
          id="how-to-start-title"
          className="m-0 mt-0.5 font-heading
                    text-[40px] font-medium leading-[1.05] tracking-[1px]
                    text-primary
                    2xl:text-[60px] 2xl:tracking-[1.2px]"
        >
          Нет своего портфолио?
        </h2>
      </div> */}

      <div className="flex flex-row px-10 2xl:px-40">
        <div className="flex flex-col w-1/2 gap-8">
          <div className="bg-white w-full h-fit py-2 px-3 gap-2 border-b border-[#6363631A] rounded-lg">
            <h2 className="m-0 mt-0.5 font-heading text-[36px] font-bold leading-[1.05] tracking-[1.2px] text-primary">
              1.
            </h2>
            <p className="font-heading text-[24px] font-medium text-black">
              Регистрируйся на сайте
            </p>
            <p className="text-[18px] font-normal text-black">
              Просто подключи свой GitHub или укажи почту и расскажи немного о себе в профиле.  
            </p>
          </div>

          <div className="bg-white w-full h-fit py-2 px-3 gap-2 border-b border-[#6363631A] rounded-lg">
            <h2 className="m-0 mt-0.5 font-heading text-[36px] font-bold leading-[1.05] tracking-[1.2px] text-primary">
              2.
            </h2>
            <p className="font-heading text-[24px] font-medium text-black">
              Найди интерeсную задачу
            </p>
            <p className="text-[18px] font-normal text-black">
              Перейди в каталог и, отфильтровав задачи на интересные тебе, реши одну из них.  
            </p>
          </div>

          <div className="bg-white w-full h-fit py-2 px-3 gap-2 border-b border-[#6363631A] rounded-lg">
            <h2 className="m-0 mt-0.5 font-heading text-[36px] font-bold leading-[1.05] tracking-[1.2px] text-primary">
              3.
            </h2>
            <p className="font-heading text-[24px] font-medium text-black">
              Опиши решение
            </p>
            <p className="text-[18px] font-normal text-black">
              Пройдя простую и понятную форму, где ты расскажешь как реализовал решение и с чем столкнулся.  
            </p>
          </div>

          <div className="bg-white w-full h-fit py-2 px-3 gap-2 border-b border-[#6363631A] rounded-lg">
            <h2 className="m-0 mt-0.5 font-heading text-[36px] font-bold leading-[1.05] tracking-[1.2px] text-primary">
              4.
            </h2>
            <p className="font-heading text-[24px] font-medium text-black">
              Портфолио готово!
            </p>
            <p className="text-[18px] font-normal text-black">
              Его ты сможешь прикрепить к своему профилю, что позволит компаниям достойно оценить тебя. 
            </p>
          </div>
        </div>
         <div className="flex w-1/2 flex-col gap-8 relative">
            <Image
              className="absolute h-auto right-[15%] bottom-[5%] hidden w-53 md:block 2xl:w-57 rotate-15"
              src="/figma/Teewee.svg"
              alt=""
              width={0}
              height={0}
              aria-hidden="true"
            />

            <Image
              className="absolute h-auto left-[15%] top-[5%] hidden w-43 md:block 2xl:w-47 rotate-55"
              src="/figma/Asterisk 2.svg"
              alt=""
              width={0}
              height={0}
              aria-hidden="true"
            />

            <Image
              className="absolute h-auto right-[20%] top-[15%] hidden w-43 md:block 2xl:w-47"
              src="/figma/Butterfly.svg"
              alt=""
              width={0}
              height={0}
              aria-hidden="true"
            />

            <Image
              className="absolute h-auto left-[15%] bottom-[25%] hidden w-53 md:block 2xl:w-57 -rotate-25"
              src="/figma/Orange Ricky.svg"
              alt=""
              width={0}
              height={0}
              aria-hidden="true"
            />
          </div>
      </div>
      
    </section>
  )
}