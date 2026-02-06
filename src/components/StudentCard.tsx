"use client";

import { cn } from "@/lib/utils";
import { User } from "lucide-react";

export type StudentStatus = "Mutqin" | "Mutawassith" | "Dhaif";

interface StudentCardProps {
    id: string;
    name: string;
    halaqah: string;
    status: StudentStatus;
    avatarUrl?: string;
    onTap?: () => void;
    onInputClick?: (e: React.MouseEvent) => void;
}

const statusBadgeClass: Record<StudentStatus, string> = {
    Mutqin: "badge-mutqin",
    Mutawassith: "badge-mutawassith",
    Dhaif: "badge-dhaif",
};

export function StudentCard({
    name,
    halaqah,
    status,
    avatarUrl,
    onTap,
    onInputClick,
}: StudentCardProps) {
    return (
        <div
            className={cn(
                "card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
            )}
            onClick={onTap}
        >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <User className="w-6 h-6 text-brand-blue-500" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-brand-blue-900 truncate">{name}</h3>
                <p className="text-sm text-gray-500">{halaqah}</p>
            </div>

            {/* Badge & Action */}
            <div className="flex flex-col items-end gap-2">
                <span className={cn("badge", statusBadgeClass[status])}>{status}</span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onInputClick?.(e);
                    }}
                    className="btn-primary text-xs py-1 px-3"
                >
                    Input
                </button>
            </div>
        </div>
    );
}
