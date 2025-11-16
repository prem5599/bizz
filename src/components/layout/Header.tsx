// components/layout/Header.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Bell,
  Search,
  Menu,
  ChevronDown,
  Settings,
  LogOut,
  User,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInterface } from "@/components/search/SearchInterface";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sample notifications - in real app, this would come from API
  const notifications = [
    {
      id: 1,
      title: "Revenue increased by 15%",
      time: "2 hours ago",
      unread: true,
    },
    {
      id: 2,
      title: "New integration connected",
      time: "1 day ago",
      unread: true,
    },
    { id: 3, title: "Weekly report ready", time: "2 days ago", unread: false },
  ];

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left section - Mobile menu + Search */}
          <div className="flex flex-1 items-center">
            {/* Mobile menu button */}
            <button
              type="button"
              className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 lg:hidden"
              onClick={onMenuClick}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Search bar */}
            <div className="ml-4 flex-1 max-w-lg">
              <SearchInterface className="w-full" />
            </div>
          </div>

          {/* Right section - Notifications + Profile */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                className="relative rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-900">
                        Notifications
                      </h3>
                      <button className="text-xs text-blue-600 hover:text-blue-800">
                        Mark all read
                      </button>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "border-t border-slate-100 px-4 py-3 hover:bg-slate-50",
                          notification.unread && "bg-blue-50"
                        )}
                      >
                        <div className="flex items-start space-x-3">
                          <div
                            className={cn(
                              "mt-1 h-2 w-2 rounded-full",
                              notification.unread
                                ? "bg-blue-500"
                                : "bg-slate-300"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-900">
                              {notification.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {notification.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 p-2">
                    <button className="w-full rounded-md px-3 py-2 text-center text-xs text-slate-600 hover:bg-slate-50">
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User profile dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                className="flex max-w-xs items-center rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              >
                <img
                  className="h-8 w-8 rounded-full object-cover"
                  src={session?.user?.image || "/default-avatar.png"}
                  alt=""
                />
                <div className="ml-3 hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900">
                    {session?.user?.name || "User"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {session?.user?.email}
                  </p>
                </div>
                <ChevronDown className="ml-2 h-4 w-4 text-slate-400" />
              </button>

              {/* Profile dropdown menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">
                      {session?.user?.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {session?.user?.email}
                    </p>
                  </div>

                  <div className="py-1">
                    <button className="flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <User className="mr-3 h-4 w-4" />
                      Profile
                    </button>
                    <button className="flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <Settings className="mr-3 h-4 w-4" />
                      Settings
                    </button>
                    <button className="flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <HelpCircle className="mr-3 h-4 w-4" />
                      Help & Support
                    </button>
                  </div>

                  <div className="border-t border-slate-100 py-1">
                    <button
                      onClick={() => signOut()}
                      className="flex w-full items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
