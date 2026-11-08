"use client";

import { Card, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bug, MoveRight, PlayCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskCardProps {
    id?: number;
    title: string;
    description: string;
    imageUrl: string;
    priceType: "free" | "subscription";
    category: "Frontend" | "Fullstack" | "Backend";
    technologies: string[];
    currentBugs: number;
    isInProgress?: boolean;
    isLoggedIn?: boolean;
    onStart?: (id: number) => void;
}

export function TaskCard({
    id,
    title,
    description,
    imageUrl,
    priceType,
    category,
    technologies,
    currentBugs,
    isInProgress = false,
    isLoggedIn = false,
    onStart,
}: TaskCardProps) {
    const priceColors = {
        free: { bg: "#A3E635", text: "#3F6212", label: "Бесплатно" },
        subscription: { bg: "#FBBF24", text: "#92400E", label: "По подписке" },
    };
    const categoryColors = {
        Frontend: { bg: "#CCFBF1", text: "#0F766E" },
        Fullstack: { bg: "#FFEDD5", text: "#EA580C" },
        Backend: { bg: "#E0E7FF", text: "#4338CA" },
    };

    const priceStyle = priceColors[priceType];
    const categoryStyle = categoryColors[category];

    const cardInner = (
        <Card className="relative mx-auto w-full max-w-sm pt-0 overflow-hidden h-full flex flex-col">
            <Badge
                variant="secondary"
                className="absolute z-40 left-4 top-4 px-3 py-3"
                style={{ backgroundColor: priceStyle.bg, color: priceStyle.text }}
            >
                {priceStyle.label}
            </Badge>
            <Badge
                variant="secondary"
                className="absolute z-40 right-4 top-4 px-3 py-3"
                style={{ backgroundColor: categoryStyle.bg, color: categoryStyle.text }}
            >
                {category}
            </Badge>
            <img
                src={imageUrl}
                alt={title}
                className="relative z-20 aspect-video w-full object-cover"
            />
            <CardHeader className="flex-1">
                <h1 className="text-xl font-heading font-medium">{title}</h1>
                <div className="flex flex-row flex-wrap gap-1">
                    {technologies.map((tech, index) => (
                        <Badge
                            key={index}
                            variant="secondary"
                            className="bg-white text-primary border border-primary"
                        >
                            {tech}
                        </Badge>
                    ))}
                </div>
                <CardDescription className="line-clamp-3">{description}</CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-row justify-between w-full mt-auto">
                <div className="flex flex-row items-end">
                    <h1 className="text-primary text-3xl font-heading font-medium">{currentBugs}</h1>
                    <Bug className="size-7 pb-1 text-primary" />
                    <p className="font-heading font-medium text-muted-foreground pb-1">/10</p>
                </div>
                <div className="flex items-center gap-2">
                    {isLoggedIn && id != null && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className={isInProgress ? "text-green-600 hover:text-green-700" : "text-primary hover:text-primary"}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isInProgress) onStart?.(id);
                            }}
                            title={isInProgress ? "Уже в процессе" : "Начать задачу"}
                        >
                            {isInProgress ? (
                                <CheckCircle2 className="size-6" />
                            ) : (
                                <PlayCircle className="size-6" />
                            )}
                        </Button>
                    )}
                    <MoveRight className="text-white rounded-full size-8 px-1 bg-black cursor-pointer hover:bg-black/80 transition-colors" />
                </div>
            </CardFooter>
        </Card>
    );

    if (id != null) {
        return <a href={`/overview/${id}`} className="block">{cardInner}</a>;
    }
    return cardInner;
}