import {JSX, SVGProps} from "react";

interface DoubleSlashProps extends SVGProps<SVGSVGElement> {}

export default function DoubleSlash({ ...props }: DoubleSlashProps): JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props} >
      <path d="M9.25 9.05882H12V2H9.25V5.52941H6.5V10.2353H3.75V14.9412H1V22H3.75V17.2941H6.5V12.5882H9.25V9.05882Z" fill="#B6A2D4"/>
      <path d="M20.25 9.05882H23V2H20.25V5.52941H17.5V10.2353H14.75V14.9412H12V22H14.75V17.2941H17.5V12.5882H20.25V9.05882Z" fill="#B6A2D4"/>
    </svg>
  );
}