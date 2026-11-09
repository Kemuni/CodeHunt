"use client"

import { ArrowDownUpIcon, ChevronDownIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react"
import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Slider } from "@/components/ui/slider"
import type { DeveloperType } from "@/lib/api/task-contract"
import {
  activeCatalogFilterCount,
  catalogSortLabels,
  defaultCatalogFilters,
  type CatalogFilters,
} from "@/lib/tasks/catalog-filters"
import { developerTypeLabels } from "@/lib/tasks/labels"

/** Одна панель управления для публичного и административного каталогов. */
export default function TaskCatalogControls({
  value,
  onChange,
}: {
  value: CatalogFilters
  onChange: (value: CatalogFilters) => void
}) {
  const activeCount = activeCatalogFilterCount(value)

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <InputGroup className="w-full sm:w-auto sm:min-w-48 sm:flex-1 border-border">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Поиск задач"
          placeholder="Поиск по задачам"
          maxLength={300}
          value={value.q}
          onChange={(event) => onChange({ ...value, q: event.target.value })}
        />
      </InputGroup>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="link" />}
          className="max-w-full"
          aria-label={`Сортировать по: ${catalogSortLabels[value.sort]}`}
        >
          <ArrowDownUpIcon aria-hidden="true" />
          <span className="hidden lg:inline ">Сортировать по:</span>
          <span className="truncate">{catalogSortLabels[value.sort]}</span>
          <ChevronDownIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" aria-label="Сортировка задач">
          <DropdownMenuRadioGroup
            value={value.sort}
            onValueChange={(sort) => onChange({ ...value, sort: sort as CatalogFilters["sort"] })}
          >
            {Object.entries(catalogSortLabels).map(([sort, label]) => (
              <DropdownMenuRadioItem key={sort} value={sort}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" />}
          aria-label={activeCount ? `Фильтры: активно ${activeCount}` : "Фильтры"}
        >
          <span className="relative">
            <SlidersHorizontalIcon aria-hidden="true" />
            {activeCount > 0 && (
              <Badge size="xs" className="absolute -right-2 -top-2" aria-hidden="true">
                {activeCount}
              </Badge>
            )}
          </span>
          Фильтры
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-72 max-w-[calc(100vw-2rem)]"
          align="end"
          aria-label="Фильтры задач"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Сложность</DropdownMenuLabel>
            <div className="space-y-3 px-3 pb-3">
              <div className="flex justify-between text-sm tabular-nums">
                <span>{value.difficulty[0]}</span>
                <span>{value.difficulty[1]}</span>
              </div>
              <Slider
                min={0}
                max={10}
                step={1}
                value={value.difficulty}
                getAriaLabel={(index) =>
                  index === 0 ? "Минимальная сложность" : "Максимальная сложность"
                }
                onValueChange={(range) => {
                  if (Array.isArray(range)) onChange({ ...value, difficulty: [range[0], range[1]] })
                }}
              />
            </div>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Направление</DropdownMenuLabel>
            {(Object.keys(developerTypeLabels) as DeveloperType[]).map((direction) => (
              <DropdownMenuCheckboxItem
                key={direction}
                checked={value.developerTypes.includes(direction)}
                closeOnClick={false}
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    developerTypes: checked
                      ? [...value.developerTypes, direction]
                      : value.developerTypes.filter((item) => item !== direction),
                  })
                }
              >
                {developerTypeLabels[direction]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Доступность</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={value.access}
              onValueChange={(access) =>
                onChange({ ...value, access: access as CatalogFilters["access"] })
              }
            >
              <DropdownMenuRadioItem value="all" closeOnClick={false}>
                Любая
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="free" closeOnClick={false}>
                Бесплатно
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="subscription" closeOnClick={false}>
                По подписке
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!activeCount}
            render={<Button variant="outline" className="w-full" />}
            closeOnClick={false}
            onClick={() =>
              onChange({
                ...value,
                difficulty: defaultCatalogFilters.difficulty,
                developerTypes: [],
                access: "all",
              })
            }
          >
            Очистить фильтры
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
