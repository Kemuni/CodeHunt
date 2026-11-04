"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";

const tabs = ["Общее", "Безопасность", "Мои задачи"];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("Общее");

  return (
    <main className="min-h-[calc(100dvh-94px)] bg-[#fbfaff] px-4 pb-20 text-[#08080c] sm:px-8 lg:px-16 xl:px-[6vw]">
      <div className="mx-auto max-w-[1040px]">
        <div className="relative mb-8 flex items-end gap-7 pt-3 sm:mb-10 sm:gap-10">
          <h1 className="relative font-heading text-[36px] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[48px] lg:text-[52px]">
            Личный кабинет
            <span className="absolute -bottom-2 left-0 h-[4px] w-[355px] max-w-full bg-[#2c5ee8]" />
            <span className="absolute -bottom-[5px] left-1 h-[9px] w-[165px] bg-[url('/figma/DotGrid.svg')] bg-[length:10px_10px] opacity-90" />
          </h1>
          <div className="mb-1 hidden size-16 rotate-[-12deg] rounded-[25px] border-2 border-dashed border-[#bba6e5] sm:block" aria-hidden="true" />
        </div>

        <div className="grid gap-5 md:grid-cols-[185px_minmax(0,1fr)] md:gap-6">
          <aside className="space-y-3">
            <section className="rounded-lg border border-[#e2e0e5] bg-white px-3 py-4 text-center">
              <div className="relative mx-auto mb-3 grid size-[114px] place-items-center overflow-hidden rounded-full bg-[#d5d5fc]">
                <Image src="/figma/Butterfly.svg" alt="Аватар пользователя" width={100} height={100} className="size-full object-cover p-2" />
                <button aria-label="Изменить фотографию" className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full bg-black text-[14px] text-white transition-transform hover:scale-105">✎</button>
              </div>
              <p className="font-heading text-[15px] font-semibold text-[#260686]">luminous453</p>
              <p className="mb-4 text-[11px] text-[#111]">◉ luminous</p>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="h-6 w-full rounded-full border border-[#ff3333] text-[11px] font-medium text-[#ed2c2c] transition-colors hover:bg-[#fff0f0]">Выйти из профиля</button>
            </section>

            <section className="rounded-lg border border-[#e2e0e5] bg-white px-3 py-4">
              <h2 className="mb-3 font-heading text-[18px] font-semibold">Статистика</h2>
              <div className="space-y-2 text-[12px]"><div className="flex justify-between"><span>Решено</span><b className="text-[#260686]">2 задачи</b></div><div className="flex justify-between"><span>В процессе</span><b className="text-[#260686]">3 задачи</b></div></div>
              <Link href="/tasks" className="mt-3 flex h-6 items-center justify-center rounded-full border border-[#260686] text-[11px] font-medium text-[#260686] transition-colors hover:bg-[#f2efff]">К задачам</Link>
            </section>
          </aside>

          <section className="min-w-0">
            <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex gap-5 border-b border-transparent text-[16px] sm:gap-6">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`relative pb-1 transition-colors ${activeTab === tab ? "font-medium after:absolute after:inset-x-0 after:-bottom-1 after:h-[2px] after:bg-[#777]" : "hover:text-[#260686]"}`}>{tab}</button>)}</div>
              <button className="flex h-[30px] w-fit items-center gap-1 rounded-full border border-[#260686] px-3 text-[14px] font-medium text-[#260686] transition-colors hover:bg-[#f2efff]"><span className="text-[18px] leading-none">+</span> Добавить решение</button>
            </div>

            {activeTab === "Общее" ? <>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard title="Обо мне">Опишите себя, свои умения и что вас<br className="hidden sm:block" /> привлекает в коде больше всего...</InfoCard>
                <InfoCard title="Мои умения">Тут будут отображаться ваши умения. Самое<br className="hidden sm:block" /> время выбрать их!</InfoCard>
              </div>
              <section className="mt-3 min-h-[108px] rounded-lg border border-[#e2e0e5] bg-white px-4 py-4"><h2 className="font-heading text-[19px] font-semibold">Мои решения</h2><div className="flex flex-col items-center justify-center pt-3 text-[12px] text-[#777]">Тут будут отображаться ваши решения задач...<Link href="/tasks" className="mt-2 rounded-full bg-[#260686] px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-[#3b12b1]">Перейти к задачам</Link></div></section>
            </> : <EmptyTab title={activeTab} />}
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="relative min-h-[91px] rounded-lg border border-[#e2e0e5] bg-white px-4 py-3"><h2 className="font-heading text-[19px] font-semibold">{title}</h2><p className="mt-2 text-[12px] leading-[1.25] text-[#777]">{children}</p><button aria-label={`Редактировать раздел ${title}`} className="absolute right-3 top-3 grid size-6 place-items-center rounded-md border border-[#e2e0e5] text-[14px] text-[#777] hover:text-[#260686]">✎</button></section>;
}

function EmptyTab({ title }: { title: string }) {
  return <section className="grid min-h-[220px] place-items-center rounded-lg border border-[#e2e0e5] bg-white text-center"><div><div className="mx-auto mb-3 grid size-9 place-items-center rounded-full bg-[#f2efff] text-[#260686]">✓</div><h2 className="font-heading text-[20px] font-semibold">{title}</h2><p className="mt-1 text-sm text-[#777]">Раздел пока пуст.</p></div></section>;
}
