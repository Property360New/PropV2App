declare module "expo-linear-gradient" {
  import * as React from "react";
  import { ViewProps } from "react-native";

  export interface LinearGradientProps extends ViewProps {
    colors: readonly (string | number)[];
    start?: { x: number; y: number } | null;
    end?: { x: number; y: number } | null;
    locations?: readonly number[] | null;
    dither?: boolean;
  }

  export const LinearGradient: React.FC<LinearGradientProps>;
}