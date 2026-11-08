import { TaskCard } from "@/components/ui/task-card";
import { Button } from "@/components/ui/button";
import Asterisk1 from "@/public/figma/company-marquee/Asterisk 3 CM.svg";
import Image from "next/image";
import { Funnel, Info, SearchIcon } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";


export default function Home() {
  return (
    <div className="w-full overflow-hidden">
      <main className="flex flex-col my-12 mx-4 sm:mx-21 2xl:mx-42">
        <div className="w-full inline-flex">
          <h1 className="text-5xl font-heading font-medium text-black">
                        <span className="underline decoration-wavy decoration-primary underline-offset-10">Каталог</span> задач
                    </h1>
          <div className="relative">
            <div className="absolute left-30 -bottom-1 size-25 rotate--45">
              <Image src={Asterisk1} alt="" className="w-25 h-25 absolute left-[10%] top-[1%]" />
            </div>
          </div>
        </div>
        <div className="w-full mt-14 flex justify-between">
          <div className="w-1/3 xl:w-2/5 h-10 "> 
            <InputGroup className="w-125 bg-white border border-[#636363]"> 
              <InputGroupInput placeholder="Введите тему или язык программирования"/>
              <InputGroupAddon align="inline-end"> <SearchIcon /> </InputGroupAddon>
            </InputGroup>
          </div>  
          <div className="w-fit flex gap-6 items-center">
            <span className="flex gap-2">
              <p>Сортировать по: Сначала новые</p>
              
            </span>
            <div className="w-32 h-10 "> 
              <Button variant="outline" className="border border-black text-black">Фильтр <Funnel /></Button>
            </div>
          </div>
        </div>
        <div className="w-full mt-4 flex justify-between">
          <p className="flex items-center gap-1.5 text-gray-500"> Как правильно выбрать задачу? <Info className="size-4" /></p>
          <span className="w-20 h-5 bg-gray-00"/>
        </div>
        <div className="w-full mt-4 grid gap-x-4 gap-y-8 [&>div]:h-90 xl:[&>div]:h-104 grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <TaskCard
                                    key="А"
                                    id= {1}
                                    title="Блог рецептов"
                                    description="Необходимо сделать многостраничный сайт для введения блога рецептов с хранением "
                                    imageUrl="https://opis-cdn.tinkoffjournal.ru/mercury/youtube-food_in.yzejbggexwx6..jpg"
                                    priceType="free"
                                    category="Backend"
                                    technologies={["Python", "SQL", "Excel"]}
                                    currentBugs={3}
                                />
          <TaskCard
                                    key="Аб"
                                    id= {2}
                                    title="Дневник отслеживания настроения"
                                    description="Реализуйте сервис для получения текста песен, используя различные источники для получения информации о"
                                    imageUrl="https://telefon-doveria.ru/wp-content/uploads/2024/01/maxresdefault.jpg"
                                    priceType="free"
                                    category="Backend"
                                    technologies={["Java", "Postgres"]}
                                    currentBugs={7}
                                />
          <TaskCard
                                    key="Або"
                                    id= {3}
                                    title="Трекер настроения"
                                    description="Создайте многостраничный сайт для трекинга настроения пользователя с хранением состояния "
                                    imageUrl="https://aelit.by/media/informatics-1024x676.jpg"
                                    priceType="free"
                                    category="Frontend"
                                    technologies={["React", "CSS", "HTML"]}
                                    currentBugs={4}
                                />
          <TaskCard
                                    key="Абоб"
                                    id= {4}
                                    title="API для парсинга песен"
                                    description="Реализуйте сервис для получения текста песен, используя различные источники для получения информации о"
                                    imageUrl="https://i.ytimg.com/vi/WJN1JFyVmrI/sddefault.jpg"
                                    priceType="subscription"
                                    category="Backend"
                                    technologies={["C++", "SQLite"]}
                                    currentBugs={7}
                                />
          <TaskCard
                                    key="ФФ"
                                    id= {5}
                                    title="Трекер настроения"
                                    description="Создайте многостраничный сайт для трекинга настроения пользователя с хранением состояния "
                                    imageUrl="https://telefon-doveria.ru/wp-content/uploads/2024/01/maxresdefault.jpg"
                                    priceType="subscription"
                                    category="Frontend"
                                    technologies={["Vue", "ShadCN"]}
                                    currentBugs={8}
                                />
          <TaskCard
                                    key="ФАВЫФВ"
                                    id= {6}
                                    title="Дневник отслеживания настроения"
                                    description="Реализуйте сервис для получения текста песен, используя различные источники для получения информации о"
                                    imageUrl="https://telefon-doveria.ru/wp-content/uploads/2024/01/maxresdefault.jpg"
                                    priceType="free"
                                    category="Backend"
                                    technologies={["Java", "Postgres"]}
                                    currentBugs={7}
                                />
          <TaskCard
                                    key="Абоба"
                                    id= {7}
                                    title="Тест скорости печати"
                                    description="Реализуйте сервис для получения текста песен, используя различные источники для получения информации о"
                                    imageUrl="https://aelit.by/media/informatics-1024x676.jpg"
                                    priceType="subscription"
                                    category="Fullstack"
                                    technologies={["Python", "SQL"]}
                                    currentBugs={9}
                                />
        </div>
      </main>
    </div>
  );
}
