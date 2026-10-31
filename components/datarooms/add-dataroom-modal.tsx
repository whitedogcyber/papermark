import { useRouter } from "next/router";

import { useState } from "react";

import { useTeam } from "@/context/team-context";
import { PlanEnum } from "@/whitedog/plans";
import {
  Brain,
  BriefcaseIcon,
  BuildingIcon,
  FileTextIcon,
  FolderIcon,
  FolderKanbanIcon,
  HomeIcon,
  LineChartIcon,
  RocketIcon,
  ShoppingCartIcon,
  Sparkles,
  TrendingUpIcon,
  XIcon,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";
import { z } from "zod";

import { useAnalytics } from "@/lib/analytics";
import { usePlan } from "@/lib/swr/use-billing";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { UpgradePlanModal } from "../billing/upgrade-plan-modal";

export function AddDataroomModal({
  children,
  openModal = false,
  setOpenModal,
}: {
  children?: React.ReactNode;
  openModal?: boolean;
  setOpenModal?: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const router = useRouter();
  const [dataroomName, setDataroomName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(openModal);
  const [activeTab, setActiveTab] = useState<string>("create");
  const [dataroomType, setDataroomType] = useState<string>("");
  const [aiDescription, setAiDescription] = useState<string>("");
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [generatedFolders, setGeneratedFolders] = useState<any[] | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<Set<string>>(
    new Set(),
  );
  const [editingFolderPath, setEditingFolderPath] = useState<string | null>(
    null,
  );
  const [editingFolderName, setEditingFolderName] = useState<string>("");

  const teamInfo = useTeam();
  const { isFree, isPro } = usePlan();
  const analytics = useAnalytics();

  const useTemplate = activeTab === "generate";
  const useAI = activeTab === "ai";

  const dataroomSchema = z.object({
    name: z.string().trim().min(3, {
      message: "Please provide a dataroom name with at least 3 characters.",
    }),
    type: z.string().optional(),
  });

  const dataroomSchemaWithType = z.object({
    type: z.enum(
      [
        "startup-fundraising",
        "raising-first-fund",
        "ma-acquisition",
        "series-a-plus",
        "real-estate-transaction",
        "fund-management",
        "portfolio-management",
        "project-management",
        "sales-dataroom",
      ],
      {
        errorMap: () => ({ message: "Please select a dataroom type." }),
      },
    ),
  });

  const TEMPLATES = [
    {
      id: "startup-fundraising",
      name: "Startup Fundraising",
      icon: RocketIcon,
    },
    {
      id: "series-a-plus",
      name: "Series A+",
      icon: TrendingUpIcon,
    },
    {
      id: "raising-first-fund",
      name: "Raising a Fund",
      icon: LineChartIcon,
    },
    {
      id: "ma-acquisition",
      name: "M&A / Acquisition",
      icon: BriefcaseIcon,
    },
    {
      id: "sales-dataroom",
      name: "Sales Data Room",
      icon: ShoppingCartIcon,
    },
    {
      id: "real-estate-transaction",
      name: "Real Estate",
      icon: HomeIcon,
    },
    {
      id: "fund-management",
      name: "Fund Management",
      icon: BuildingIcon,
    },
    {
      id: "portfolio-management",
      name: "Portfolio Management",
      icon: FolderKanbanIcon,
    },
    {
      id: "project-management",
      name: "Project Management",
      icon: FileTextIcon,
    },
  ];

  const handleGenerateFolders = async () => {
    if (!aiDescription.trim()) {
      return toast.error(
        "Please describe what kind of dataroom you want to create.",
      );
    }

    setAiGenerating(true);

    try {
      const response = await fetch(
        `/api/teams/${teamInfo?.currentTeam?.id}/datarooms/generate-ai-structure`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: aiDescription.trim(),
          }),
        },
      );

      if (!response.ok) {
        const { message } = await response.json();
        setAiGenerating(false);
        toast.error(message || "Failed to generate folder structure");
        return;
      }

      const { name, folders } = await response.json();
      setGeneratedFolders(folders);
      // Set the generated name as default, but allow user to edit it
      if (name) {
        setDataroomName(name);
      }
      // Initialize all folders as selected
      initializeFolderSelection(folders);
      setShowPreview(true);
      setAiGenerating(false);
    } catch (error) {
      setAiGenerating(false);
      toast.error("Error generating folder structure. Please try again.");
    }
  };

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    event.stopPropagation();

    // For AI generation, if we're in preview mode, create the dataroom
    if (useAI && showPreview && generatedFolders) {
      // Validate dataroom name
      if (!dataroomName.trim()) {
        return toast.error("Please provide a dataroom name.");
      }

      if (dataroomName.trim().length < 3) {
        return toast.error(
          "Please provide a dataroom name with at least 3 characters.",
        );
      }

      // Filter folders based on selection
      const filteredFolders = filterSelectedFolders(generatedFolders);

      if (filteredFolders.length === 0) {
        return toast.error("Please select at least one folder to include.");
      }

      setLoading(true);
      try {
        const response = await fetch(
          `/api/teams/${teamInfo?.currentTeam?.id}/datarooms/generate-ai`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: dataroomName.trim(),
              folders: filteredFolders,
            }),
          },
        );

        if (!response.ok) {
          const { message } = await response.json();
          setLoading(false);
          toast.error(message);
          return;
        }

        const { dataroom } = await response.json();

        analytics.capture("Dataroom Generated with AI", {
          dataroomName: dataroomName.trim(),
        });

        mutate(`/api/teams/${teamInfo?.currentTeam?.id}/datarooms`);
        toast.success("Dataroom successfully generated! 🎉");
        router.push(`/datarooms/${dataroom.id}/documents`);
      } catch (error) {
        setLoading(false);
        toast.error("Error creating dataroom. Please try again.");
        return;
      } finally {
        setLoading(false);
        setOpen(false);
        if (openModal && setOpenModal) setOpenModal(false);
      }
      return;
    }

    // Validate based on whether template is enabled
    const schema = useTemplate ? dataroomSchemaWithType : dataroomSchema;
    const validation = schema.safeParse({
      name: useTemplate ? undefined : dataroomName,
      type: useTemplate ? dataroomType : undefined,
    });

    if (!validation.success) {
      return toast.error(validation.error.errors[0].message);
    }

    setLoading(true);

    try {
      // Use different endpoint based on whether template is enabled
      const endpoint = useTemplate
        ? `/api/teams/${teamInfo?.currentTeam?.id}/datarooms/generate`
        : `/api/teams/${teamInfo?.currentTeam?.id}/datarooms`;

      const body = useTemplate
        ? {
            type: dataroomType,
            // Name will be taken from template
          }
        : { name: dataroomName.trim() };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const { message } = await response.json();
        setLoading(false);
        toast.error(message);
        return;
      }

      const { dataroom } = await response.json();

      analytics.capture(
        useTemplate ? "Dataroom Generated" : "Dataroom Created",
        {
          dataroomName: dataroomName,
          ...(useTemplate && { dataroomType: dataroomType }),
        },
      );

      mutate(`/api/teams/${teamInfo?.currentTeam?.id}/datarooms`);
      toast.success(
        useTemplate
          ? "Dataroom successfully created! 🎉"
          : "Dataroom successfully created! 🎉",
      );
      router.push(`/datarooms/${dataroom.id}/documents`);
    } catch (error) {
      setLoading(false);
      toast.error("Error adding dataroom. Please try again.");
      return;
    } finally {
      setLoading(false);
      setOpen(false);
      if (openModal && setOpenModal) setOpenModal(false);
    }
  };

  // If the team is on a free plan, show the upgrade modal
  if (isFree || isPro) {
    if (children) {
      return (
        <UpgradePlanModal
          clickedPlan={PlanEnum.DataRooms}
          trigger={"add_dataroom_overview"}
        >
          {children}
        </UpgradePlanModal>
      );
    }
  }

  const onOpenChange = (open: boolean) => {
    if (!open) {
      setOpen(false);
      setDataroomName("");
      setActiveTab("create");
      setDataroomType("");
      setAiDescription("");
      setGeneratedFolders(null);
      setShowPreview(false);
      setSelectedFolderPaths(new Set());
      setEditingFolderPath(null);
      setEditingFolderName("");
    } else {
      setOpen(true);
    }
    if (openModal && setOpenModal) setOpenModal(false);
  };

  // Generate a unique path for each folder
  const generateFolderPath = (folder: any, parentPath: string = ""): string => {
    const currentPath = parentPath
      ? `${parentPath}/${folder.name}`
      : folder.name;
    return currentPath;
  };

  // Update folder name in the folder structure
  const updateFolderName = (
    folders: any[],
    targetPath: string,
    newName: string,
    currentPath: string = "",
  ): any[] => {
    return folders.map((folder) => {
      const folderPath = generateFolderPath(folder, currentPath);

      if (folderPath === targetPath) {
        // Update this folder's name
        return { ...folder, name: newName };
      }

      // Recursively update subfolders
      if (folder.subfolders && folder.subfolders.length > 0) {
        return {
          ...folder,
          subfolders: updateFolderName(
            folder.subfolders,
            targetPath,
            newName,
            folderPath,
          ),
        };
      }

      return folder;
    });
  };

  // Handle folder name edit
  const handleFolderNameEdit = (path: string, currentName: string) => {
    setEditingFolderPath(path);
    setEditingFolderName(currentName);
  };

  // Save edited folder name
  const saveFolderName = () => {
    if (!editingFolderPath || !generatedFolders) return;

    if (editingFolderName.trim()) {
      const updatedFolders = updateFolderName(
        generatedFolders,
        editingFolderPath,
        editingFolderName.trim(),
      );
      setGeneratedFolders(updatedFolders);

      // Update selected paths if needed (recalculate paths)
      initializeFolderSelection(updatedFolders);
    }

    setEditingFolderPath(null);
    setEditingFolderName("");
  };

  // Cancel editing
  const cancelFolderNameEdit = () => {
    setEditingFolderPath(null);
    setEditingFolderName("");
  };

  // Toggle folder selection
  const toggleFolderSelection = (path: string, folder: any) => {
    const newSelected = new Set(selectedFolderPaths);

    if (newSelected.has(path)) {
      // If unchecking, remove this folder and all its subfolders
      newSelected.delete(path);
      const removeSubfolders = (f: any, currentPath: string) => {
        if (f.subfolders) {
          f.subfolders.forEach((sub: any) => {
            const subPath = generateFolderPath(sub, currentPath);
            newSelected.delete(subPath);
            removeSubfolders(sub, subPath);
          });
        }
      };
      removeSubfolders(folder, path);
    } else {
      // If checking, add this folder
      newSelected.add(path);
    }

    setSelectedFolderPaths(newSelected);
  };

  // Filter folders based on selection
  const filterSelectedFolders = (
    folders: any[],
    parentPath: string = "",
  ): any[] => {
    return folders
      .map((folder) => {
        const currentPath = generateFolderPath(folder, parentPath);
        const isSelected = selectedFolderPaths.has(currentPath);

        if (!isSelected) {
          return null;
        }

        const filteredSubfolders = folder.subfolders
          ? filterSelectedFolders(folder.subfolders, currentPath)
          : undefined;

        return {
          ...folder,
          subfolders:
            filteredSubfolders && filteredSubfolders.length > 0
              ? filteredSubfolders
              : undefined,
        };
      })
      .filter((folder) => folder !== null);
  };

  // Initialize all folders as selected when preview is shown
  const initializeFolderSelection = (
    folders: any[],
    parentPath: string = "",
  ) => {
    const paths = new Set<string>();
    const collectPaths = (f: any[], currentPath: string = "") => {
      f.forEach((folder) => {
        const folderPath = generateFolderPath(folder, currentPath);
        paths.add(folderPath);
        if (folder.subfolders) {
          collectPaths(folder.subfolders, folderPath);
        }
      });
    };
    collectPaths(folders);
    setSelectedFolderPaths(paths);
  };

  const renderFolderPreview = (
    folders: any[],
    indent = 0,
    parentPath: string = "",
  ) => {
    return (
      <div className="space-y-1">
        {folders.map((folder, index) => {
          const currentPath = generateFolderPath(folder, parentPath);
          const isSelected = selectedFolderPaths.has(currentPath);

          return (
            <div key={`${parentPath}-${index}`} className="pl-4">
              <div className="flex items-center gap-2 py-1">
                <div
                  className="h-4 w-4"
                  style={{ marginLeft: `${indent * 16}px` }}
                />
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() =>
                    toggleFolderSelection(currentPath, folder)
                  }
                  id={`folder-${currentPath}`}
                />
                <label
                  htmlFor={`folder-${currentPath}`}
                  className="flex flex-1 cursor-pointer items-center gap-2"
                >
                  <FolderIcon className="h-4 w-4 text-gray-500" />
                  {editingFolderPath === currentPath ? (
                    <Input
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onBlur={saveFolderName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveFolderName();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelFolderNameEdit();
                        }
                      }}
                      className="h-6 px-2 py-1 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="cursor-text rounded px-1 py-0.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFolderNameEdit(currentPath, folder.name);
                      }}
                      title="Click to edit folder name"
                    >
                      {folder.name}
                    </span>
                  )}
                </label>
              </div>
              {folder.subfolders && folder.subfolders.length > 0 && (
                <div className="ml-4">
                  {renderFolderPreview(
                    folder.subfolders,
                    indent + 1,
                    currentPath,
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="border-none bg-transparent text-foreground shadow-none sm:max-w-[575px] [&>button]:hidden">
        <DialogTitle className="sr-only">Create Dataroom</DialogTitle>
        <DialogDescription className="sr-only">
          Create a new dataroom or generate one with pre-configured folders
        </DialogDescription>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            // Reset AI-related state when switching tabs
            if (value !== "ai") {
              setAiDescription("");
              setGeneratedFolders(null);
              setShowPreview(false);
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create from scratch</TabsTrigger>
            <TabsTrigger value="generate">Create from template</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card className="relative outline-none focus:outline-none">
              <button
                onClick={() => onOpenChange(false)}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
              <CardHeader className="space-y-3">
                <CardTitle>Create dataroom</CardTitle>
                <CardDescription>
                  Start creating a dataroom with a name.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col space-y-4 outline-none"
                >
                  <div className="space-y-1">
                    <Label htmlFor="dataroom-name-create">
                      Dataroom Name{" "}
                      <span className="text-black dark:text-white">*</span>
                    </Label>
                    <Input
                      id="dataroom-name-create"
                      placeholder="ACME Acquisition"
                      value={dataroomName}
                      onChange={(e) => setDataroomName(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" loading={loading}>
                    Add new dataroom
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="generate">
            <Card className="relative outline-none focus:outline-none">
              <button
                onClick={() => onOpenChange(false)}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
              <CardHeader className="space-y-3">
                <CardTitle>Create dataroom</CardTitle>
                <CardDescription>
                  Create a dataroom with pre-configured folder structure.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col space-y-4 outline-none"
                >
                  <div className="space-y-2">
                    <Label>
                      Select Template{" "}
                      <span className="text-black dark:text-white">*</span>
                    </Label>
                    <div className="grid grid-cols-3 divide-x divide-y divide-border overflow-hidden rounded-md border">
                      {TEMPLATES.map((template) => {
                        const Icon = template.icon;
                        const isSelected = dataroomType === template.id;

                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setDataroomType(template.id)}
                            className={`relative flex min-h-[120px] flex-col items-center justify-center space-y-3 overflow-hidden p-4 transition-colors ${
                              isSelected
                                ? "bg-gray-200 dark:bg-gray-800"
                                : "hover:bg-gray-100 hover:dark:bg-gray-800"
                            }`}
                          >
                            <Icon className="pointer-events-none h-auto w-10 text-foreground" />
                            <p className="text-sm">{template.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    loading={loading}
                    disabled={!dataroomType}
                  >
                    Create new dataroom
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
