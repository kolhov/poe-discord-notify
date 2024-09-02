import {getDivPrice, getLeague, processCurrency} from "./src/utills.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
processCurrency().then();

